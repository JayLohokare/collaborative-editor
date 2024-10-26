// deltaUtils.js
module.exports = {
  createDelta(baseContent = '', newContent = '', startPos = 0, endPos = 0) {
      // Input validation
      if (typeof baseContent !== 'string' || typeof newContent !== 'string') {
          throw new Error('baseContent and newContent must be strings');
      }

      // Ensure positions are valid numbers
      startPos = Math.max(0, Math.min(parseInt(startPos) || 0, baseContent.length));
      endPos = Math.max(0, Math.min(parseInt(endPos) || 0, baseContent.length));

      // Ensure positions are in correct order
      if (endPos < startPos) {
          [startPos, endPos] = [endPos, startPos];
      }

      let delta = [];
      
      // Content before change
      if (startPos > 0) {
          delta.push({ retain: startPos });
      }
      
      // Handle deletion if any
      const deletionLength = endPos - startPos;
      if (deletionLength > 0) {
          delta.push({ delete: deletionLength });
      }
      
      // Handle insertion if any
      if (newContent !== baseContent) {
          const insertContent = newContent.slice(startPos, startPos + (newContent.length - baseContent.length + deletionLength));
          if (insertContent.length > 0) {
              delta.push({ insert: insertContent });
          }
      }
      
      // Retain remaining content
      const remainingLength = baseContent.length - endPos;
      if (remainingLength > 0) {
          delta.push({ retain: remainingLength });
      }
      
      return delta;
  },

  applyDelta(content = '', delta = []) {
      if (typeof content !== 'string') {
          throw new Error('Content must be a string');
      }
      if (!Array.isArray(delta)) {
          throw new Error('Delta must be an array');
      }

      let result = '';
      let position = 0;
      
      for (const operation of delta) {
          if (operation.retain) {
              const retainLength = Math.min(operation.retain, content.length - position);
              result += content.slice(position, position + retainLength);
              position += retainLength;
          } else if (operation.delete) {
              position += Math.min(operation.delete, content.length - position);
          } else if (operation.insert) {
              result += operation.insert;
          }
      }
      
      // Append any remaining content
      if (position < content.length) {
          result += content.slice(position);
      }
      
      return result;
  },

  composeDelta(delta1 = [], delta2 = []) {
      if (!Array.isArray(delta1) || !Array.isArray(delta2)) {
          throw new Error('Both deltas must be arrays');
      }
      return [...delta1, ...delta2];
  }
};