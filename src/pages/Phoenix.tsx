// Example: ./src/pages/Phoenix.tsx
import ThemeProvider from '@/components/ThemeProvider';
import ThemeBackgroundPage from '@/components/utils/layout/ThemeBackgroundPage';
import { phoenixContent } from '@/content/phoenix-content';
const Phoenix = () => (
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <ThemeBackgroundPage content={phoenixContent} />
  </ThemeProvider>
);
export default Phoenix;