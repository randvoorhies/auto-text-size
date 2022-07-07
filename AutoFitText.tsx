import {
  CSSProperties,
  DetailedHTMLProps,
  HTMLAttributes,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
} from "react";

/**
 * Never call `func` more than once per animation frame.
 *
 * Using requestAnimationFrame in this way ensures that we render as often as
 * possible without blocking the UI.
 */
function throttleToNextFrame(func: () => void): () => void {
  let wait = false;

  return () => {
    if (!wait) {
      wait = true;
      requestAnimationFrame(() => {
        func();
        wait = false;
      });
    }
  };
}

type Config = {
  multiline?: boolean;
  ellipsis?: boolean;
  minFontSizePx?: number;
  maxFontSizePx?: number;
};

/**
 * Adjust the font size of `innerEl` so that it doesn't overflow `containerEl`.
 */
export function autoFitText({
  innerEl,
  containerEl,
  multiline,
  ellipsis,
  minFontSizePx = 5,
  maxFontSizePx = 200,
}: Config & {
  innerEl: HTMLElement | undefined | null;
  containerEl: HTMLElement | undefined | null;
}): void {
  if (!innerEl || !containerEl) return;

  if (containerEl.children.length > 1) {
    console.warn(
      `AutoSizeText has ${
        containerEl.children.length - 1
      } siblings. This may interfere with the auto-size algorithm.`
    );
  }

  // Add styling when necessary
  console.log(!multiline && ellipsis)
  if (!multiline && ellipsis) {
    // This allows proper computation of the dimensions `innerEl`.
    containerEl.style.display = "flex";
    containerEl.style.alignItems = "start";
  }

  if (innerEl.scrollHeight === 0 || innerEl.scrollWidth === 0) {
    return;
  }

  const innerDisplay = window
  .getComputedStyle(innerEl, null)
  .getPropertyValue("display");

  console.log({innerDisplay})
  if (innerDisplay !== 'block') {
    innerEl.style.display = 'block' // Necessary to compute bounding box
  }

  const deltaFactor = 1.05; // Adjust font size 5% in each iteration

  const fontSizeStr = window
    .getComputedStyle(innerEl, null)
    .getPropertyValue("font-size");
  let fontSizePx = parseFloat(fontSizeStr);

  const setFontSizePx = (px: number): void => {
    fontSizePx = px;
    innerEl.style.fontSize = `${fontSizePx}px`;
  };

  if (!multiline) {
    while (
      innerEl.scrollWidth <= containerEl.clientWidth &&
      fontSizePx < maxFontSizePx
    ) {
      setFontSizePx(fontSizePx * deltaFactor);
    }

    while (
      (ellipsis
        ? innerEl.scrollWidth >= containerEl.clientWidth
        : innerEl.scrollWidth > containerEl.clientWidth) &&
      fontSizePx > minFontSizePx
    ) {
      setFontSizePx(fontSizePx / deltaFactor);
    }
  } else {
    /**
     * Multiline has more edge cases than single line.
     *
     * Must use `>=` rather than `>` since the element `innerEl` can have
     * `innerEl.scrollWidth === containerEl.scrollWidth` even though there is
     * room for resizing.
     */
    while (
      innerEl.scrollWidth <= containerEl.clientWidth &&
      innerEl.scrollHeight <= containerEl.clientHeight &&
      fontSizePx < maxFontSizePx
    ) {
      setFontSizePx(fontSizePx * deltaFactor);
    }

    // Must use `>` rather than `>=` since the width can be max for long text,
    // wich would case the loop to run until minFontSize is reached
    while (
      (innerEl.scrollWidth > containerEl.clientWidth ||
        innerEl.scrollHeight > containerEl.clientHeight) &&
      fontSizePx > minFontSizePx
    ) {
      setFontSizePx(fontSizePx / deltaFactor);
    }
  }

  // The above loops can overshoot. Adjust for this. This is better than
  // stopping the loops one iteration earlier, because then we wouldn't get all
  // the way to the limit. Adjusting the setp size based on how close we are to
  // the limit is messier than this.
  if (fontSizePx < minFontSizePx) {
    setFontSizePx(minFontSizePx);
  }

  if (fontSizePx > maxFontSizePx) {
    setFontSizePx(maxFontSizePx);
  }
}

/**
 * React component wrapping `autoFitText` for ease of use.
 *
 * ```jsx
 * <AutoFitText>{title}</AutoFitText>
 * ```
 */
export function AutoFitText({
  multiline,
  ellipsis,
  maxFontSizePx,
  minFontSizePx,
  as: Comp = "div",
  style = {},
  children,
  ...rest
}: Config & {
  as?: string | React.ComponentType<any>;
} & DetailedHTMLProps<
    HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >): ReactElement {
  const ref = useRef<HTMLInputElement>(null);

  const throttledAutoFitText = useMemo(() => {
    return throttleToNextFrame(() =>
      autoFitText({
        innerEl: ref.current,
        containerEl: ref.current?.parentElement,
        multiline,
        ellipsis,
        maxFontSizePx,
        minFontSizePx,
      })
    );
  }, [ellipsis, maxFontSizePx, minFontSizePx, multiline]);

  useEffect(throttledAutoFitText, [children, throttledAutoFitText]);

  useEffect(() => {
    window.addEventListener("resize", throttledAutoFitText);
    return () => window.removeEventListener("resize", throttledAutoFitText);
  }, [throttledAutoFitText]);

  if (ellipsis) {
    style = {
      ...style,
      maxWidth: "100%",
      textOverflow: "ellipsis",
      overflow: "hidden",
    };
  }

  if (multiline) {
    style.whiteSpace = "pre-wrap";
  } else {
    style.whiteSpace = "nowrap";
  }

  return (
    <Comp ref={ref} style={style} {...rest}>
      {children}
    </Comp>
  );
}
