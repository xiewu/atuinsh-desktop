import { forwardRef, useMemo } from "react";
import { AvatarIcon, useAvatar, AvatarProps as BaseAvatarProps } from "@heroui/react";

export interface AvatarProps extends BaseAvatarProps {
  outlineColor: string;
}

const ColorAvatar = forwardRef<HTMLSpanElement, AvatarProps>((props, ref) => {
  const outlineColor = props.outlineColor;
  const updatedProps = { ...props };
  delete (updatedProps as any).outlineColor;

  const {
    src,
    icon = <AvatarIcon />,
    alt,
    classNames,
    slots,
    name,
    showFallback,
    fallback: fallbackComponent,
    getInitials,
    getAvatarProps,
    getImageProps,
  } = useAvatar({
    ref,
    ...updatedProps,
  });

  const fallback = useMemo(() => {
    if (!showFallback && src) return null;

    const ariaLabel = alt || name || "avatar";

    if (fallbackComponent) {
      return (
        <div
          aria-label={ariaLabel}
          className={slots.fallback({ class: classNames?.fallback })}
          role="img"
        >
          {fallbackComponent}
        </div>
      );
    }

    return name ? (
      <span aria-label={ariaLabel} className={slots.name({ class: classNames?.name })} role="img">
        {getInitials(name)}
      </span>
    ) : (
      <span aria-label={ariaLabel} className={slots.icon({ class: classNames?.icon })} role="img">
        {icon}
      </span>
    );
  }, [showFallback, src, fallbackComponent, name, classNames]);

  return (
    <div {...getAvatarProps()} style={{ outlineColor: outlineColor }}>
      {src && <img {...getImageProps()} alt={alt} />}
      {fallback}
    </div>
  );
});

ColorAvatar.displayName = "ColorAvatar";

export default ColorAvatar;
