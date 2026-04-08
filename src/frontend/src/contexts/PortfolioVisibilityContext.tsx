import { usePortfolioVisibility } from "@/hooks/usePortfolioVisibility";
import { type ReactNode, createContext, useContext } from "react";

interface PortfolioVisibilityContextValue {
  isVisible: boolean;
  toggleVisibility: () => void;
  mask: (value: string) => string;
}

const PortfolioVisibilityContext =
  createContext<PortfolioVisibilityContextValue>({
    isVisible: true,
    toggleVisibility: () => {},
    mask: (v) => v,
  });

export function PortfolioVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isVisible, toggleVisibility] = usePortfolioVisibility();

  const mask = (value: string) => (isVisible ? value : "•••••");

  return (
    <PortfolioVisibilityContext.Provider
      value={{ isVisible, toggleVisibility, mask }}
    >
      {children}
    </PortfolioVisibilityContext.Provider>
  );
}

export function usePortfolioVisibilityContext() {
  return useContext(PortfolioVisibilityContext);
}
