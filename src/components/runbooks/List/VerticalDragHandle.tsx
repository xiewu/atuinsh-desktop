import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import React, { memo, useEffect, useRef, useState } from "react";

interface VerticalDragHandleProps {
  minSize: number;
  onResize: (delta: number) => void;
}

const VerticalDragHandle = memo((props: VerticalDragHandleProps) => {
  const handleWidth = 8; // even numbers
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const [dragging, setDragging] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const info = useRef({
    startX: 0,
    minX: 0,
  });

  function setPosition(clientX: number) {
    if (!ref.current) return;
    let right = info.current.startX - Math.max(clientX, info.current.minX);
    ref.current.style.right = `${right - handleWidth / 2}px`;
  }

  function unsetPosition() {
    if (!ref.current) return;
    ref.current.style.right = `-${handleWidth / 2}px`;
  }

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    setDragging(true);
    info.current.startX = event.clientX;
    info.current.minX = info.current.startX - (sidebarWidth - props.minSize);
  }

  function handleMouseUp(event: MouseEvent) {
    event.preventDefault();
    setDragging(false);
    props.onResize(Math.max(event.clientX, info.current.minX) - info.current.startX);
    unsetPosition();
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(event: MouseEvent) {
      if (!dragging) return;
      event.preventDefault();
      setPosition(event.clientX);
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
    <>
      {/* This is a hack to prevent the mouse from activating mouse events on background elements while dragging */}
      {dragging && <div className="fixed top-0 bottom-0 left-0 right-0 bg-transparent z-[998]" />}
      <div
        ref={ref}
        className={cn([
          "absolute top-0 bottom-0 w-[6px] bg-gray-200 dark:bg-gray-800 cursor-col-resize z-[999]",
        ])}
        style={{
          right: `-${handleWidth / 2}px`,
          opacity: dragging ? 1 : 0,
        }}
        onMouseDown={handleMouseDown}
      />
    </>
  );
});

export default VerticalDragHandle;
