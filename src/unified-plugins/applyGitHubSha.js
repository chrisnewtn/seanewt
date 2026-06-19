import {select} from 'hast-util-select';
import path from 'node:path/posix';

/**
 * @type {import('unified').Plugin<[{
 *  githubSha: string | undefined
 *  githubUrl: string | undefined
 * }], import('hast').Root>}
 */
export default function applyGitHubSha({
  githubSha,
  githubUrl,
}) {
  return async tree => {
    const el = select('#github-sha', tree);

    if (!el || !githubSha || !githubUrl) {
      return;
    }

    const commitUrl = new URL(githubUrl);
    commitUrl.pathname = path.join(commitUrl.pathname, 'commit', githubSha);

    el.properties.href = commitUrl.toString();
    el.children = [
      {
        type: 'text',
        value: githubSha.substring(0, 7)
      }
    ];
  };
}
