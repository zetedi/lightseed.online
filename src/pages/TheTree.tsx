import ThemeProvider from "@/components/ThemeProvider";
import ThemeBackgroundPage from "@/components/utils/layout/ThemeBackgroundPage";
import TheTree from "@/components/tree/TheTree";

const treeContent = [
  {
    title: "Intention Matches",
    content: <TheTree />,
  },
];

const TheTreePage = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ThemeBackgroundPage content={treeContent} />
    </ThemeProvider>
  );
};

export default TheTreePage;