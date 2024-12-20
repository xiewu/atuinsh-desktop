import React, { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@nextui-org/react";

interface EditableHeadingProps {
  initialText?: string;
  onTextChange?: (text: string) => void;
}

const EditableHeading: React.FC<EditableHeadingProps> = ({
  initialText = "Click to edit",
  onTextChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onTextChange?.(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      onTextChange?.(text);
    }
  };

  return (
    <div className="group relative inline-flex items-center gap-2">
      {isEditing ? (
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          variant="bordered"
        />
      ) : (
        <>
          <h1
            onDoubleClick={handleDoubleClick}
            className="text-2xl font-bold leading-none cursor-pointer"
          >
            {text}
          </h1>
          <Pencil
            className="opacity-0 group-hover:opacity-100 transition-opacity text-default-400 cursor-pointer"
            size={20}
            onClick={() => setIsEditing(true)}
          />
        </>
      )}
    </div>
  );
};

export default EditableHeading;
