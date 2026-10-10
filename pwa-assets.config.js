// Full-bleed orange square; the OS supplies the installed icon's corner mask.
export default {
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [],
      padding: 0,
    },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ["public/app-icon.svg"],
};
