const bytesPerKilobyte = 1024

export const bytesToKilobytes = (bytes: number) => bytes / bytesPerKilobyte

export const bytesToMegabytes = (bytes: number) =>
  bytesToKilobytes(bytes) / bytesPerKilobyte
