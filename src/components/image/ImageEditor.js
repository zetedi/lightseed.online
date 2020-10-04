import React from "react";
import AvatarEditor from "react-avatar-editor";

class ImageEditor extends React.Component {
  render() {
    return (
      <AvatarEditor
        image="https://firebasestorage.googleapis.com/v0/b/light-5197c.appspot.com/o/383593943759.JPG?alt=media&token"
        width={250}
        height={250}
        border={50}
        borderRadius={125}
        color={[255, 255, 255, 0.6]} // RGBA
        scale={1.2}
        rotate={0}
      />
    );
  }
}

export default ImageEditor;
