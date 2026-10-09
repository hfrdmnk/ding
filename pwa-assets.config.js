// The source is a full-bleed tile with the safe-zone margin built in, so no
// output gets extra padding.
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
