import { getConnectedEdges } from '@xyflow/react';

/**
 *
 * @param {Node[]} selectedNodes
 * @param {Edge[]} allEdges
 * @returns the edges, with added style for edges connected to the selected node.
 */
export const highlightConnectedEdges = (selectedNodes, allEdges) => {
  let connectedIds = []
  if (selectedNodes && selectedNodes.length === 1) {
    let connectedEdges = getConnectedEdges(selectedNodes, allEdges)
    connectedIds = connectedEdges.map((i) => i.id)
  }

  return allEdges.map((edge) => {
    const color = connectedIds.includes(edge.id) ? '#0000ff' : '#fcfcfc'

    if (edge.color === '#0000ff') {
      return edge
    }
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: color
      }
     }
  })
}