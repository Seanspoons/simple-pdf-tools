import type { Config } from '@imgly/background-removal';

type BackgroundRemovalModule = typeof import('@imgly/background-removal');

let modulePromise: Promise<BackgroundRemovalModule> | null = null;
let preloadPromise: Promise<void> | null = null;

function canUseGpu() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function createConfig(progress?: Config['progress']): Config {
  return {
    debug: false,
    device: canUseGpu() ? 'gpu' : 'cpu',
    model: canUseGpu() ? 'isnet_fp16' : 'isnet',
    progress,
    output: {
      format: 'image/png',
      quality: 1
    }
  };
}

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import('@imgly/background-removal');
  }

  return modulePromise;
}

export async function preloadBackgroundRemoval(progress?: Config['progress']) {
  const module = await loadModule();

  if (!preloadPromise) {
    preloadPromise = module.preload(createConfig(progress));
  }

  return preloadPromise;
}

export async function removeImageBackground(
  image: Blob | File,
  progress?: Config['progress']
) {
  const module = await loadModule();
  await preloadBackgroundRemoval(progress);
  return module.removeBackground(image, createConfig(progress));
}
