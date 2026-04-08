import { useCallback, useState } from "react";

const STORAGE_KEY = "miinsolio-portfolio-visible";

export function usePortfolioVisibility(): [boolean, () => void] {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return [isVisible, toggleVisibility];
}
