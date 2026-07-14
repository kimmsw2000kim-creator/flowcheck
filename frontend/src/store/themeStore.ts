import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
type AppliedTheme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'flowcheck-theme';

function getStoredTheme(): Theme {
    const savedTheme = localStorage.getItem(STORAGE_KEY);

    if (
        savedTheme === 'light' ||
        savedTheme === 'dark' ||
        savedTheme === 'system'
    ) {
        return savedTheme;
    }

    return 'system';
}

function resolveTheme(theme: Theme): AppliedTheme {
    if (theme !== 'system') {
        return theme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function applyTheme(theme: Theme) {
    const appliedTheme = resolveTheme(theme);

    document.documentElement.dataset.theme = appliedTheme;
    document.documentElement.style.colorScheme = appliedTheme;
}

export const useThemeStore = create<ThemeState>((set) => ({
    theme: getStoredTheme(),

    setTheme: (theme) => {
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
        set({ theme });
    },
}));

let initialized = false;

export function initializeTheme() {
    if (initialized) return;

    initialized = true;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    applyTheme(useThemeStore.getState().theme);

    mediaQuery.addEventListener('change', () => {
        const currentTheme = useThemeStore.getState().theme;

        if (currentTheme === 'system') {
            applyTheme(currentTheme);
        }
    });
}