// Type declaration for animejs v3
declare module 'animejs' {
  interface AnimeParams {
    targets?: any;
    duration?: number;
    delay?: number | Function;
    endDelay?: number;
    easing?: string | Function;
    round?: number;
    loop?: number | boolean;
    direction?: 'normal' | 'reverse' | 'alternate';
    autoplay?: boolean;
    complete?: (anim: AnimeInstance) => void;
    update?: (anim: AnimeInstance) => void;
    begin?: (anim: AnimeInstance) => void;
    [prop: string]: any;
  }

  interface AnimeInstance {
    play(): void;
    pause(): void;
    restart(): void;
    reverse(): void;
    seek(time: number): void;
    finished: Promise<void>;
  }

  interface AnimeStatic {
    (params: AnimeParams): AnimeInstance;
    default?: AnimeStatic;
  }

  const anime: AnimeStatic;
  export = anime;
}
