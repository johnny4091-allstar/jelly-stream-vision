import Constants from 'expo-constants';

/** CARTO Basemaps key baked in at build time (CARTO_KEY secret); empty means CARTO's open tiles. */
export const cartoKey: string = (Constants.expoConfig?.extra?.cartoKey as string | undefined) ?? '';
