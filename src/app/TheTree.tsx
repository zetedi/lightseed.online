import ThemeProvider from "@/components/ThemeProvider";

import TheTree from "@/components//tree/TheTree";

// A simple spacer component for clarity in the map function

const Yantra = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TheTree />
    </ThemeProvider>
  );
};

export default Yantra;
