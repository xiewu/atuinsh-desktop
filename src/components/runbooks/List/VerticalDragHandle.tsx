import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface VerticalDragHandleProps {
  parent: { offsetLeft: number; offsetWidth: number };
  minSize: number;
  onResize: (size: number) => void;
}

export default function VerticalDragHandle(props: VerticalDragHandleProps) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const info = useRef({
    currPos: 0,
  });

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    setDragging(true);
  }

  function handleMouseUp(event: MouseEvent) {
    event.preventDefault();
    setDragging(false);
    props.onResize(info.current.currPos - props.parent.offsetLeft);
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(event: MouseEvent) {
      if (!dragging) return;
      event.preventDefault();
      let newSize = event.clientX - props.parent.offsetLeft;
      if (newSize < props.minSize) {
        newSize = props.minSize;
      }
      info.current.currPos = props.parent.offsetLeft + newSize;
      ref.current!.style.left = `${info.current.currPos}px`;
    }

    document.body.classList.add("resizing");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.classList.remove("resizing");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  return (
    <div
      ref={ref}
      className={cn([
        "absolute top-0 bottom-0 w-[6px] bg-gray-200 dark:bg-gray-800 cursor-col-resize z-[999]",
      ])}
      style={{
        opacity: dragging ? 1 : 0,
        left: props.parent.offsetLeft + props.parent.offsetWidth - 3,
      }}
      onMouseDown={handleMouseDown}
    />
  );
}
