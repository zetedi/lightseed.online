import { Cloudinary as CoreCloudinary, Util } from 'cloudinary-core';

export const url = (publicId, options) => {
  const scOptions = Util.withSnakeCaseKeys(options);
  const cl = CoreCloudinary.new();
  return cl.url(publicId, scOptions);
};

export const openUploadWidget = (options, callback) => {
  const scOptions = Util.withSnakeCaseKeys(options);
  window.cloudinary.openUploadWidget(scOptions, callback);
};

export const openCustomUploadWidget = (callback) => {
  window.cloudinary.openUploadWidget(
    {
      cloudName: 'ezimg',
      uploadPreset: 'wobiwbrp',
      sources: ['local', 'camera'],
      showAdvancedOptions: false,
      cropping: true,
      multiple: false,
      defaultSource: 'camera',
      styles: {
        palette: {
          window: 'yellow',
          sourceBg: '#f4f4f5',
          windowBorder: '#90a0b3',
          tabIcon: '#000000',
          inactiveTabIcon: '#555a5f',
          menuIcons: '#555a5f',
          link: '#0433ff',
          action: '#339933',
          inProgress: '#0433ff',
          complete: '#339933',
          error: '#cc0000',
          textDark: '#000000',
          textLight: '#fcfffd',
        },
        fonts: {
          default: null,
          'sans-serif': {
            url: null,
            active: true,
          },
        },
      },
    },
    callback
  );
};
export async function fetchPhotos(imageTag, setter) {
  const options = {
    cloudName: 'ezimg',
    format: 'json',
    type: 'list',
    version: Math.ceil(new Date().getTime() / 1000),
  };

  const urlPath = url(imageTag.toString(), options);

  fetch(urlPath)
    .then((res) => res.text())
    .then((text) =>
      text
        ? setter(JSON.parse(text).resources.map((image) => image.public_id))
        : []
    )
    .catch((err) => console.log(err));
}
