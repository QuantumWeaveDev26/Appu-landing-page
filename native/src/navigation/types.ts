import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Auth: undefined;
  Chat: { initialPrompt?: string } | undefined;
  ParentZone: undefined;
  Settings: undefined;
  StudySchedule: { prefillTopic?: string } | undefined;
  Legal:
    | {
        initialTab?:
          | 'privacy'
          | 'terms'
          | 'cancellation'
          | 'shipping'
          | 'pricing'
          | 'contact';
      }
    | undefined;
};

export type RootStackNavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type RootStackRouteProp<T extends keyof RootStackParamList> =
  RouteProp<RootStackParamList, T>;
