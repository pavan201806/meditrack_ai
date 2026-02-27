import { Platform } from 'react-native';

const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

export const typography = {
    h1: {
        fontFamily,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    h2: {
        fontFamily,
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    h3: {
        fontFamily,
        fontSize: 18,
        fontWeight: '600',
    },
    h4: {
        fontFamily,
        fontSize: 16,
        fontWeight: '600',
    },
    body: {
        fontFamily,
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
    },
    bodySmall: {
        fontFamily,
        fontSize: 13,
        fontWeight: '400',
        lineHeight: 18,
    },
    caption: {
        fontFamily,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    button: {
        fontFamily,
        fontSize: 16,
        fontWeight: '600',
    },
    label: {
        fontFamily,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    number: {
        fontFamily,
        fontSize: 32,
        fontWeight: '700',
    },
    numberSmall: {
        fontFamily,
        fontSize: 24,
        fontWeight: '700',
    },
};
