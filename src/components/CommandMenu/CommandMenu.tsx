import { type ButtonProps } from "@heroui/react";
import { Command } from "cmdk";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button, Kbd, Modal, ModalContent, cn } from "@heroui/react";
import { tv } from "tailwind-variants";
import MultiRef from "react-multi-ref";
import scrollIntoView from "scroll-into-view-if-needed";
import { isAppleDevice, isWebKit } from "@react-aria/utils";
import { useMediaQuery } from "usehooks-ts";

import { useUpdateEffect } from "./use-update-effect";
import { type SearchResultItem } from "./data";

import { AtuinState, useStore } from "@/state/store";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon, NotebookIcon, SearchIcon, XIcon } from "lucide-react";
import RunbookIndexService from "@/state/runbooks/search";
import { useQuery } from "@tanstack/react-query";
import { allRunbooks } from "@/lib/queries/runbooks";
import { allWorkspaces } from "@/lib/queries/workspaces";

const cmdk = tv({
  slots: {
    base: "max-h-full h-auto",
    header: [
      "flex",
      "items-center",
      "w-full",
      "px-4",
      "border-b",
      "border-default-400/50",
      "dark:border-default-100",
    ],
    searchIcon: "text-default-400 text-lg [&>g]:stroke-[2px]",
    input: [
      "w-full",
      "px-2",
      "h-14",
      "font-sans",
      "text-lg",
      "outline-none",
      "rounded-none",
      "bg-transparent",
      "text-default-700",
      "placeholder-default-500",
      "dark:text-default-500",
      "dark:placeholder:text-default-300",
    ],
    listScroll: ["pt-2", "pr-4", "pb-6", "overflow-y-auto"],
    list: ["max-h-[50vh] sm:max-h-[40vh]"],
    listWrapper: ["flex", "flex-col", "gap-4", "pb-4"],
    itemWrapper: [
      "px-4",
      "mt-2",
      "group",
      "flex",
      "h-[54px]",
      "justify-between",
      "items-center",
      "rounded-lg",
      "shadow",
      "bg-content2/50",
      "active:opacity-70",
      "cursor-pointer",
      "transition-opacity",
      "data-[active=true]:bg-primary",
      "data-[active=true]:text-primary-foreground",
    ],
    leftWrapper: ["flex", "gap-3", "items-center", "w-full", "max-w-full"],
    leftWrapperOnMobile: ["flex", "gap-3", "items-center", "w-full", "max-w-[166px]"],
    rightWrapper: ["flex", "flex-row", "gap-2", "items-center"],
    leftIcon: [
      "text-default-500 dark:text-default-300",
      "group-data-[active=true]:text-primary-foreground",
    ],
    itemContent: ["flex", "flex-col", "gap-0", "justify-center", "max-w-[80%]"],
    itemParentTitle: [
      "text-default-400",
      "text-xs",
      "group-data-[active=true]:text-primary-foreground",
      "select-none",
    ],
    itemTitle: [
      "truncate",
      "text-default-500",
      "group-data-[active=true]:text-primary-foreground",
      "select-none",
    ],
    emptyWrapper: ["flex", "flex-col", "text-center", "items-center", "justify-center", "h-32"],
    sectionTitle: ["text-xs", "font-semibold", "leading-4", "text-default-900"],
    categoryItem: [
      "h-[50px]",
      "gap-3",
      "py-2",
      "bg-default-100/50",
      "text-medium",
      "text-default-500",
      "data-[hover=true]:bg-default-400/40",
      "data-[selected=true]:bg-default-400/40",
      "data-[selected=true]:text-white",
      "data-[selected=true]:focus:bg-default-400/40",
    ],
    groupItem: [
      "flex-none",
      "aspect-square",
      "rounded-large",
      "overflow-hidden",
      "cursor-pointer",
      "border-small",
      "h-[120px]",
      "w-[120px]",
      "border-white/10",
      "bg-black/20",
      "data-[active=true]:bg-white/[.05]",
      "data-[active=true]:text-primary-foreground",
    ],
  },
});

interface CommandMenuProps {
  index: RunbookIndexService;
}

export default function CommandMenu(props: CommandMenuProps) {
  const [query, setQuery] = useState("");
  const [activeItem, setActiveItem] = useState(0);
  const [menuNodes] = useState(() => new MultiRef<number, HTMLElement>());
  const slots = useMemo(() => cmdk(), []);
  const eventRef = useRef<"mouse" | "keyboard">(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: runbooks } = useQuery(allRunbooks());
  const { data: workspaces } = useQuery(allWorkspaces());
  const [isOpen, setOpen] = useStore((store: AtuinState) => [
    store.searchOpen,
    store.setSearchOpen,
  ]);
  const setCurrentRunbookId = useStore((store: AtuinState) => store.setCurrentRunbookId);
  const currentWorkspaceId = useStore((store: AtuinState) => store.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((store: AtuinState) => store.setCurrentWorkspaceId);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const navigate = useNavigate();

  const onClose = useCallback(() => {
    setOpen(false);
  }, []);

  const onOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const isMobile = useMediaQuery("(max-width: 650px)");

  useEffect(() => {
    let cancelled = false;
    if (query.length < 2) setResults([]);

    (async () => {
      let matches = await props.index.searchRunbooks(query);
      let res: (SearchResultItem | null)[] = matches.map((id) => {
        let rb = (runbooks || []).find((runbook) => runbook.id === id);

        if (!rb) return null;

        return {
          id: rb.id,
          workspaceId: rb.workspaceId,
          workspaceName: (workspaces || []).find((w) => w.id === rb.workspaceId)?.name || null,
          title: rb.name,
          type: "runbook",
          subtitle: "edited xyz ago",
        };
      });

      if (!cancelled) setResults(res.filter((r) => r !== null));
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const hotkey = isAppleDevice() ? "metaKey" : "ctrlKey";

      if (e?.key?.toLowerCase() === "p" && e[hotkey]) {
        e.preventDefault();
        isOpen ? onClose() : onOpen();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpen, onClose]);

  const onItemSelect = useCallback(
    (item: SearchResultItem) => {
      onClose();

      setQuery("");
      navigate("/runbooks");
      if (item.workspaceId) {
        setCurrentWorkspaceId(item.workspaceId);
      }
      setCurrentRunbookId(item.id);
    },
    [onClose],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      eventRef.current = "keyboard";
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();

          if (activeItem + 1 < results.length) {
            setActiveItem(activeItem + 1);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (activeItem - 1 >= 0) {
            setActiveItem(activeItem - 1);
          }
          break;
        }
        case "Control":
        case "Alt":
        case "Shift": {
          e.preventDefault();
          break;
        }
        case "Enter": {
          if (results?.length <= 0) {
            break;
          }

          if (activeItem < results.length) {
            onItemSelect(results[activeItem]);
            break;
          }

          break;
        }
      }
    },
    [activeItem, results, onItemSelect, query],
  );

  useUpdateEffect(() => {
    setActiveItem(0);
  }, [query]);

  useUpdateEffect(() => {
    if (!listRef.current || eventRef.current === "mouse") return;
    const node = menuNodes.map.get(activeItem);

    if (!node) return;
    scrollIntoView(node, {
      scrollMode: "if-needed",
      behavior: "smooth",
      block: "end",
      inline: "end",
      boundary: listRef.current,
    });
  }, [activeItem]);

  const CloseButton = useCallback(
    ({
      onPress,
      className,
    }: {
      onPress?: ButtonProps["onPress"];
      className?: ButtonProps["className"];
    }) => {
      return (
        <Button
          isIconOnly
          className={cn(
            "border border-default-400 data-[hover=true]:bg-content2 dark:border-default-100",
            className,
          )}
          radius="full"
          size="sm"
          variant="bordered"
          onPress={onPress}
        >
          <XIcon fontSize={16} />
        </Button>
      );
    },
    [],
  );

  // render search result items.
  const renderSearchItem = useCallback(
    (item: SearchResultItem, index: number) => {
      const isActive = index === activeItem;
      const content = (
        <Command.Item
          key={item.id}
          ref={menuNodes.ref(index)}
          className={slots.itemWrapper()}
          data-active={isActive}
          value={item.id}
          onMouseEnter={() => {
            eventRef.current = "mouse";
            setActiveItem(index);
          }}
          onMouseLeave={() => {
            if (isActive) {
              setActiveItem(-1);
            }
          }}
          onSelect={() => {
            if (eventRef.current === "keyboard") {
              return;
            }
            onItemSelect(item);
          }}
        >
          <div className={isMobile ? slots.leftWrapperOnMobile() : slots.leftWrapper()}>
            <NotebookIcon size={18} />

            <div className="flex justify-between items-center w-full">
              <p className={slots.itemTitle()}>{item.title}</p>
              {item.workspaceId !== currentWorkspaceId && (
                <p className={slots.itemContent() + " text-sm"}>{item.workspaceName}</p>
              )}
            </div>
          </div>
          {query.length > 0 && (
            <div className={slots.rightWrapper()}>
              <ChevronRightIcon />
            </div>
          )}
        </Command.Item>
      );

      return content;
    },
    [activeItem, menuNodes, slots, isMobile, query, onItemSelect],
  );

  return (
    <>
      <Modal
        hideCloseButton
        backdrop="blur"
        classNames={{
          base: [
            "mt-[20vh]",
            "border-small",
            "dark:border-default-100",
            "supports-[backdrop-filter]:bg-background/80",
            "dark:supports-[backdrop-filter]:bg-background/30",
            "supports-[backdrop-filter]:backdrop-blur-md",
            "supports-[backdrop-filter]:backdrop-saturate-150",
          ],
        }}
        isOpen={isOpen}
        motionProps={{
          onAnimationComplete: () => {
            if (!isOpen) {
              setQuery("");
            }
          },
        }}
        placement="top"
        scrollBehavior="inside"
        size={"2xl"}
        onClose={() => onClose()}
        disableAnimation
      >
        <ModalContent>
          <Command className={slots.base()} label="Quick search command" shouldFilter={false}>
            <div className={slots.header()}>
              <SearchIcon fontSize="20" />
              <Command.Input
                ref={inputRef}
                autoFocus={!isWebKit()}
                className={slots.input()}
                placeholder="Search Runbooks..."
                value={query}
                onKeyDown={onInputKeyDown}
                onValueChange={setQuery}
              />
              {query.length > 0 && <CloseButton onPress={() => setQuery("")} />}
              <Kbd className="ml-2 hidden border-none px-2 py-1 text-[0.6rem] font-medium md:block">
                ESC
              </Kbd>
            </div>
            <div ref={listRef} className={cn(slots.listScroll(), "pl-4")}>
              <Command.List className={cn(slots.list(), "[&>div]:pb-4")} role="listbox">
                {query.length > 0 && (
                  <Command.Empty>
                    <div className={slots.emptyWrapper()}>
                      <div>
                        <p>No results for &quot;{query}&quot;</p>
                        {query.length === 1 ? (
                          <p className="text-default-400">
                            Try adding more characters to your search term.
                          </p>
                        ) : (
                          <p className="text-default-400">Try searching for something else.</p>
                        )}
                      </div>
                    </div>
                  </Command.Empty>
                )}
                {results.map((item, index) => renderSearchItem(item, index))}
              </Command.List>
            </div>
          </Command>
        </ModalContent>
      </Modal>
    </>
  );
}
