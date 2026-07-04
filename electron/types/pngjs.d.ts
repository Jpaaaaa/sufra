declare module 'pngjs' {
  export interface PNGData {
    width: number;
    height: number;
    data: Buffer;
  }

  export class PNG {
    width: number;
    height: number;
    data: Buffer;

    static sync: {
      read(buffer: Buffer): PNGData;
      write(png: PNGData): Buffer;
    };
  }
}

