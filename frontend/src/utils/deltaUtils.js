export const DeltaUtils = {
    createDelta(baseContent = '', newContent = '', selection = { start: 0, end: 0 }) {
      if (typeof baseContent !== 'string' || typeof newContent !== 'string') {
        throw new Error('baseContent and newContent must be strings');
      }
  
      const operations = [];
      let currentPos = 0;
      
      // Find the common prefix
      while (currentPos < Math.min(baseContent.length, newContent.length) && 
             baseContent[currentPos] === newContent[currentPos]) {
        currentPos++;
      }
      
      if (currentPos > 0) {
        operations.push({ retain: currentPos });
      }
      
      // Find the common suffix
      let baseEnd = baseContent.length - 1;
      let newEnd = newContent.length - 1;
      while (baseEnd > currentPos && newEnd > currentPos && 
             baseContent[baseEnd] === newContent[newEnd]) {
        baseEnd--;
        newEnd--;
      }
      
      // Handle the changed content
      const deletedContent = baseContent.slice(currentPos, baseEnd + 1);
      if (deletedContent.length > 0) {
        operations.push({ delete: deletedContent.length });
      }
      
      const insertedContent = newContent.slice(currentPos, newEnd + 1);
      if (insertedContent.length > 0) {
        operations.push({ insert: insertedContent });
      }
      
      // Retain the common suffix
      const suffixLength = baseContent.length - baseEnd - 1;
      if (suffixLength > 0) {
        operations.push({ retain: suffixLength });
      }
      
      return operations;
    },
  
    applyDelta(content = '', operations = []) {
      if (typeof content !== 'string') {
        throw new Error('Content must be a string');
      }
      
      let result = '';
      let position = 0;
      
      for (const op of operations) {
        if (op.retain) {
          const retainLength = Math.min(op.retain, content.length - position);
          result += content.slice(position, position + retainLength);
          position += retainLength;
        } else if (op.delete) {
          position += Math.min(op.delete, content.length - position);
        } else if (op.insert) {
          result += op.insert;
        }
      }
      
      if (position < content.length) {
        result += content.slice(position);
      }
      
      return result;
    },
  
    transformDelta(delta1, delta2) {
      const transformed1 = [];
      const transformed2 = [];
      let pos1 = 0;
      let pos2 = 0;
      
      while (pos1 < delta1.length || pos2 < delta2.length) {
        const op1 = delta1[pos1];
        const op2 = delta2[pos2];
        
        if (!op1) {
          transformed1.push({ ...op2 });
          pos2++;
          continue;
        }
        
        if (!op2) {
          transformed2.push({ ...op1 });
          pos1++;
          continue;
        }
        
        if (op1.retain && op2.retain) {
          const length = Math.min(op1.retain, op2.retain);
          transformed1.push({ retain: length });
          transformed2.push({ retain: length });
          
          if (op1.retain > length) {
            delta1[pos1] = { retain: op1.retain - length };
          } else {
            pos1++;
          }
          
          if (op2.retain > length) {
            delta2[pos2] = { retain: op2.retain - length };
          } else {
            pos2++;
          }
        } else if (op1.insert) {
          transformed1.push({ insert: op1.insert });
          transformed2.push({ retain: op1.insert.length });
          pos1++;
        } else if (op2.insert) {
          transformed1.push({ retain: op2.insert.length });
          transformed2.push({ insert: op2.insert });
          pos2++;
        } else if (op1.delete && op2.delete) {
          const length = Math.min(op1.delete, op2.delete);
          if (op1.delete > length) {
            delta1[pos1] = { delete: op1.delete - length };
          } else {
            pos1++;
          }
          if (op2.delete > length) {
            delta2[pos2] = { delete: op2.delete - length };
          } else {
            pos2++;
          }
        }
      }
      
      return [transformed1, transformed2];
    }
  };