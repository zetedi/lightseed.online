import { useContext, createContext, useState } from 'react';

const LocalStateContext = createContext();

const LocalStateProvider = LocalStateContext.Provider;

function AppStateProvider({ children }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function closeCart() {
    setCartOpen(false);
  }

  function openCart() {
    setCartOpen(true);
  }
  function toggleCart() {
    setCartOpen(!cartOpen);
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
        cartOpen,
        setCartOpen,
        toggleCart,
        closeCart,
        openCart,
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
