import {select} from 'hast-util-select';

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function applyGitHubSha() {
  const GITHUB_SHA = process.env.GITHUB_SHA;

  return async tree => {
    const el = select('#github-sha', tree);

    if (!el || !GITHUB_SHA) {
      return;
    }

    el.properties.href = `https://github.com/chrisnewtn/chrisnewtn.github.io/commit/${GITHUB_SHA}`;
    el.children = [
      {
        type: 'text',
        value: GITHUB_SHA.substring(0, 7)
      }
    ];
  };
}
