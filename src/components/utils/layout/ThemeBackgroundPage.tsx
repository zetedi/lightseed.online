import React from 'react';
import TextStrip from '../../text-strip/TextStrip';

interface ThemeBackgroundPageProps {
  content: { title: string; content: React.ReactNode }[];
}

const Spacer = ({ height = '7vh' }: { height?: string }) => <div style={{ height }} />;

const ThemeBackgroundPage: React.FC<ThemeBackgroundPageProps> = ({ content }) => {
  return (
    <div className="relative h-auto overflow-x-hidden bg-transparent">
      <div className="relative z-10">
        <Spacer height="3vh" />
        {content.map((section, index) => (
          <React.Fragment key={section.title}>
            <TextStrip title={section.title}>{section.content}</TextStrip>
            {index < content.length - 1 && <Spacer />}
          </React.Fragment>
        ))}
        <Spacer height="3vh" />
      </div>
    </div>
  );
};

export default ThemeBackgroundPage;