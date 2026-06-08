/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./extension/*.{html,js}"],
  theme: {
    extend: {
      "colors": {
              "surface-container-highest": "#353437",
              "surface-container": "#1f1f21",
              "on-primary": "#002e69",
              "on-primary-fixed": "#001a41",
              "inverse-on-surface": "#303032",
              "on-background": "#e4e2e4",
              "primary-fixed-dim": "#adc6ff",
              "primary-container": "#4b8eff",
              "outline": "#8b90a0",
              "on-tertiary-container": "#002957",
              "surface-container-lowest": "#0e0e10",
              "on-secondary-fixed": "#310048",
              "surface-container-high": "#2a2a2c",
              "error-container": "#93000a",
              "inverse-primary": "#005bc1",
              "error": "#ffb4ab",
              "primary-fixed": "#d8e2ff",
              "outline-variant": "#414755",
              "on-secondary": "#510074",
              "on-primary-fixed-variant": "#004493",
              "secondary": "#e9b3ff",
              "on-error-container": "#ffdad6",
              "tertiary": "#aac7ff",
              "secondary-fixed-dim": "#e9b3ff",
              "surface-tint": "#adc6ff",
              "surface": "#131315",
              "surface-bright": "#39393b",
              "on-tertiary-fixed": "#001b3e",
              "secondary-container": "#7d01b1",
              "primary": "#adc6ff",
              "on-surface": "#e4e2e4",
              "tertiary-fixed": "#d6e3ff",
              "on-secondary-container": "#e5a9ff",
              "on-secondary-fixed-variant": "#7200a3",
              "surface-variant": "#353437",
              "tertiary-container": "#3e90ff",
              "on-surface-variant": "#c1c6d7",
              "surface-container-low": "#1b1b1d",
              "inverse-surface": "#e4e2e4",
              "secondary-fixed": "#f6d9ff",
              "on-tertiary-fixed-variant": "#00468d",
              "background": "#131315",
              "tertiary-fixed-dim": "#aac7ff",
              "on-tertiary": "#003064",
              "on-error": "#690005",
              "surface-dim": "#131315",
              "on-primary-container": "#00285c"
      },
      "borderRadius": {
              "DEFAULT": "0.125rem",
              "lg": "0.25rem",
              "xl": "0.5rem",
              "full": "0.75rem"
      },
      "spacing": {
              "container-padding": "1.25rem",
              "sidebar-width": "320px",
              "stack-gap": "0.75rem",
              "section-gap": "1.5rem",
              "inner-padding": "1rem"
      },
      "fontFamily": {
              "label-md": ["Geist", "sans-serif"],
              "display-sm": ["Inter", "sans-serif"],
              "body-sm": ["Inter", "sans-serif"],
              "body-lg": ["Inter", "sans-serif"],
              "mono-code": ["Geist", "sans-serif"],
              "headline-md": ["Inter", "sans-serif"]
      },
      "fontSize": {
              "label-md": ["12px", {"lineHeight": "16px","letterSpacing": "0.05em","fontWeight": "500"}],
              "display-sm": ["30px", {"lineHeight": "38px","letterSpacing": "-0.02em","fontWeight": "700"}],
              "body-sm": ["14px", {"lineHeight": "20px","fontWeight": "400"}],
              "body-lg": ["16px", {"lineHeight": "24px","fontWeight": "400"}],
              "mono-code": ["13px", {"lineHeight": "20px","fontWeight": "400"}],
              "headline-md": ["20px", {"lineHeight": "28px","letterSpacing": "-0.01em","fontWeight": "600"}]
      }
    }
  },
  plugins: []
};
