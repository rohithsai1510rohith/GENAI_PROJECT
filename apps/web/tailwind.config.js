/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          card: "var(--bg-card)",
          "card-subtle": "var(--bg-card-subtle)",
          popover: "var(--bg-popover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverted: "var(--text-inverted)",
        },
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
        },
        accent: {
          primary: "var(--accent-primary)",
          hover: "var(--accent-hover)",
          light: "var(--accent-light)",
        },
        status: {
          "success-bg": "var(--status-success-bg)",
          "success-text": "var(--status-success-text)",
          "success-border": "var(--status-success-border)",
          "warning-bg": "var(--status-warning-bg)",
          "warning-text": "var(--status-warning-text)",
          "warning-border": "var(--status-warning-border)",
          "danger-bg": "var(--status-danger-bg)",
          "danger-text": "var(--status-danger-text)",
          "danger-border": "var(--status-danger-border)",
        },
      },
      boxShadow: {
        drawer: "var(--shadow-drawer)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
