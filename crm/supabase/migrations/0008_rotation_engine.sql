-- =====================================================================
-- 0008 · Lead Rotation Engine (MVP: round-robin + SLA expiry)
-- ---------------------------------------------------------------------
-- Phase-1 engine. Weighted + AI-recommended modes plug into the same
-- entry point later. Runs as SECURITY DEFINER so a manager can trigger
-- distribution without needing direct write grants on every table; the
-- function itself enforces the tenant boundary from the passed policy.
-- =====================================================================

-- Distribute all unassigned 'new' leads of a tenant across its active
-- sales agents, round-robin, honoring the policy's max_per_agent + SLA.
-- Returns the number of leads assigned.
create or replace function public.rotate_leads_round_robin(p_policy_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id   uuid;
  v_max         int;
  v_sla         int;
  v_agents      uuid[];
  v_agent_count int;
  v_lead        record;
  v_idx         int := 0;
  v_assigned    int := 0;
  v_agent       uuid;
begin
  select tenant_id, max_per_agent, sla_minutes
    into v_tenant_id, v_max, v_sla
    from rotation_policies
   where id = p_policy_id and is_active;

  if v_tenant_id is null then
    raise exception 'Rotation policy % not found or inactive', p_policy_id;
  end if;

  -- Active agents of this tenant, ordered by current active load (lightest first).
  select array_agg(u.id order by coalesce(load.cnt, 0), u.id)
    into v_agents
    from users u
    left join (
      select assignee_id, count(*) cnt
        from lead_assignments
       where tenant_id = v_tenant_id
         and assignee_type = 'sales_agent'
         and status = 'active'
       group by assignee_id
    ) load on load.assignee_id = u.id
   where u.tenant_id = v_tenant_id
     and u.role = 'sales_agent'
     and u.is_active;

  v_agent_count := coalesce(array_length(v_agents, 1), 0);
  if v_agent_count = 0 then
    raise exception 'No active sales agents in tenant %', v_tenant_id;
  end if;

  -- Walk unassigned new leads, oldest first, and hand them out in a ring.
  <<lead_loop>>
  for v_lead in
    select l.id
      from leads l
     where l.tenant_id = v_tenant_id
       and l.stage = 'new'
       and not exists (
         select 1 from lead_assignments a
          where a.lead_id = l.id and a.status = 'active'
       )
     order by l.created_at
  loop
    -- Find the next agent still under the per-agent cap. Try at most
    -- v_agent_count agents; if all are full, distribution is done.
    v_agent := null;
    for i in 1 .. v_agent_count loop
      declare
        v_candidate uuid := v_agents[(v_idx % v_agent_count) + 1];
        v_load      int;
      begin
        v_idx := v_idx + 1;
        select count(*) into v_load
          from lead_assignments
         where assignee_id = v_candidate
           and assignee_type = 'sales_agent'
           and status = 'active';
        if v_load < v_max then
          v_agent := v_candidate;
          exit;  -- inner loop: found an eligible agent
        end if;
      end;
    end loop;

    -- Every agent is at capacity → stop the whole rotation.
    exit lead_loop when v_agent is null;

    insert into lead_assignments (
      tenant_id, lead_id, assignee_type, assignee_id,
      policy_id, assigned_by, status, expires_at
    ) values (
      v_tenant_id, v_lead.id, 'sales_agent', v_agent,
      p_policy_id, 'auto', 'active',
      now() + make_interval(mins => v_sla)
    );

    update leads set stage = 'assigned' where id = v_lead.id;

    v_assigned := v_assigned + 1;
  end loop;

  return v_assigned;
end;
$$;

-- ---------------------------------------------------------------------
-- SLA sweep: expire active assignments past their deadline and recycle
-- the lead back into the pool (stage → recycled) so it can be re-rotated.
-- Intended to run on a schedule via pg_cron.
-- ---------------------------------------------------------------------
create or replace function public.expire_stale_assignments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update lead_assignments
       set status = 'expired'
     where status = 'active'
       and expires_at is not null
       and expires_at < now()
    returning lead_id, tenant_id, policy_id
  ),
  recycled as (
    update leads l
       set stage = 'recycled'
      from expired e
     where l.id = e.lead_id
       and exists (
         select 1 from rotation_policies rp
          where rp.id = e.policy_id and rp.recycle_enabled
       )
    returning l.id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;
