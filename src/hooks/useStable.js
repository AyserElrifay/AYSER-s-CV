import { useRef } from 'react';

/* ─── WHY A LIST FLICKERS WHEN YOU TYPE ───────────────────────────────
   Writing a small component inside a bigger one is the natural way to
   write React, and it is also the single most expensive mistake you can
   make in it:

     const Screen = () => {
       const Row = ({ item }) => <View>…</View>;      // ← new every render
       return list.map((x) => <Row key={x.id} item={x} />);
     };

   React decides whether to UPDATE an element or REBUILD it by comparing
   the element's type — and the type here is that arrow function, which
   is a different object on every single render. So React concludes the
   old Row and the new Row are unrelated components, throws away every
   row on screen, and builds them all again from nothing. Images reload.
   Scroll jumps. A text box inside one loses your cursor between one
   letter and the next.

   That is not a slow render, it is a rebuilt screen, and it happens on
   every keystroke, every tap, every tick of a timer.

   useStable fixes it without moving anything. It hands back ONE function
   that never changes identity, and routes each call through the freshest
   version of your render code — so React updates the rows in place,
   while the component still closes over current state exactly as it did
   before. One line at each site, no props to thread, no dependency list
   to get wrong.

     const Row = useStable(({ item }) => <View>…</View>);

   When a component is genuinely independent of its parent's state,
   lifting it to module scope is still better — it can then be memoised
   and skip re-rendering altogether, which is what Discover's rows do.
   This is for the ones that legitimately close over the screen around
   them.                                                                */
export function useStable(render) {
  const live = useRef(render);
  live.current = render;
  // created once, so React sees the same component type for ever
  return useRef((props) => live.current(props)).current;
}
