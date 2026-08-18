import { layoutElements } from './layout';
import { controlElements } from './controls';
import { brandingElements } from './branding';
import { settingsElements } from './settings';
import { chatElements } from './chat';
import { speedrunElements } from './speedrun';
import { shortcutElements } from './shortcuts';
import { resetProgressElements } from './resetProgress';

export const elements = {
    ...layoutElements,
    ...controlElements,
    ...brandingElements,
    ...settingsElements,
    ...chatElements,
    ...speedrunElements,
    ...shortcutElements,
    ...resetProgressElements,
};

export {
    layoutElements,
    controlElements,
    brandingElements,
    settingsElements,
    chatElements,
    speedrunElements,
    shortcutElements,
    resetProgressElements,
};
