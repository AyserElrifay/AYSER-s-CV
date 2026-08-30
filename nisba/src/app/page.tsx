import { redirect } from 'next/navigation';
import { currentUser } from '@/server/session';

export default async function IndexPage() {
  redirect((await currentUser()) ? '/app' : '/signin');
}
