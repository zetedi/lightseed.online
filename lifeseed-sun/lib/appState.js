import { useContext, createContext, useState } from 'react';

const LocalStateContext = createContext();

const LocalStateProvider = LocalStateContext.Provider;

function AppStateProvider({ children }) {
  const [basketOpen, setBasketOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function closeBasket() {
    setBasketOpen(false);
  }

  function openBasket() {
    setBasketOpen(true);
  }
  function toggleBasket() {
    setBasketOpen(!basketOpen);
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function openSearch() {
    setSearchOpen(true);
  }
  function toggleSearch() {
    setSearchOpen((prev) => !prev);
  }

  return (
    <LocalStateProvider
      value={{
        basketOpen,
        setBasketOpen,
        toggleBasket,
        closeBasket,
        openBasket,
        searchOpen,
        setSearchOpen,
        toggleSearch,
        closeSearch,
        openSearch,
      }}
    >
      {children}
    </LocalStateProvider>
  );
}

function useApp() {
  const all = useContext(LocalStateContext);
  return all;
}
export { AppStateProvider, useApp };
