import type { ModalProps } from 'react-native';

/**
 * Every orientation, for React Native's <Modal>. On iOS a Modal supports only portrait unless told
 * otherwise, so opening one on an iPad held in landscape can rotate the screen or crash the app.
 */
export const ALL_ORIENTATIONS: ModalProps['supportedOrientations'] = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'];
