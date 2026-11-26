import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Home: { startTour?: boolean; initialPrompt?: string } | undefined;
  Auth: { initialPrompt?: string; returnTo?: 'Chat' | 'Home' | 'ParentZone' } | undefined;
  Chat: { initialPrompt?: string; startTour?: boolean } | undefined;
  ParentZone:
    | {
        tab?: 'learners' | 'personalization' | 'subscription' | 'reports';
        initialPrompt?: string;
        returnToChat?: boolean;
        promptSetupRequired?: boolean;
      }
    | undefined;
  Settings: undefined;
  MyLearning: undefined;
  Lesson: { lessonId: string; mode?: 'lesson' | 'quiz' | 'cards' | 'diagram' | 'guide' | 'podcast' };
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
