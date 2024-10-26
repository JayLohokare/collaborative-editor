// src/services/collaborationService.js

class CollaborationService {
    constructor() {
      this.pendingOperations = [];
      this.appliedOperations = [];
      this.baseVersion = 0;
      this.socket = null;
      this.content = '';
      this.callbacks = {
        onContentChange: null,
        onError: null
      };
    }
  
    initialize(socket, initialContent, callbacks = {}) {
      this.socket = socket;
      this.content = initialContent;
      this.callbacks = { ...this.callbacks, ...callbacks };
      this.setupSocketListeners();
      return this;
    }
  
    setupSocketListeners() {
      if (!this.socket) {
        throw new Error('Socket not initialized');
      }
  
      this.socket.on('content-delta', ({ delta, baseVersion, userId }) => {
        try {
          if (baseVersion < this.baseVersion) {
            // Transform received delta against all operations since baseVersion
            const operationsSinceBase = this.appliedOperations.slice(baseVersion);
            let transformedDelta = delta;
            
            for (const op of operationsSinceBase) {
              const [clientDelta, serverDelta] = this.transformDelta(transformedDelta, op);
              transformedDelta = clientDelta;
            }
            
            this.applyDelta(transformedDelta, userId);
          } else {
            this.applyDelta(delta, userId);
          }
        } catch (error) {
          console.error('Error processing delta:', error);
          this.callbacks.onError?.(error);
        }
      });
  
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.callbacks.onError?.(error);
      });
    }
  
    applyDelta(delta, userId) {
      try {
        const newContent = this.applyOperations(this.content, delta);
        this.content = newContent;
        this.appliedOperations.push(delta);
        this.baseVersion++;
        
        // Notify listeners of content change
        this.callbacks.onContentChange?.(newContent, {
          source: userId,
          version: this.baseVersion
        });
        
        return newContent;
      } catch (error) {
        console.error('Error applying delta:', error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }
  
    createDelta(newContent, selection) {
      try {
        const delta = this.createOperations(this.content, newContent, selection);
        
        if (this.pendingOperations.length > 0) {
          // Transform against pending operations
          const [transformedDelta] = this.transformDelta(
            delta,
            this.pendingOperations[this.pendingOperations.length - 1]
          );
          return transformedDelta;
        }
        
        return delta;
      } catch (error) {
        console.error('Error creating delta:', error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }
  
    createOperations(oldContent = '', newContent = '', selection = { start: 0, end: 0 }) {
      const operations = [];
      let currentPos = 0;
      
      // Find the common prefix
      while (currentPos < Math.min(oldContent.length, newContent.length) && 
             oldContent[currentPos] === newContent[currentPos]) {
        currentPos++;
      }
      
      if (currentPos > 0) {
        operations.push({ retain: currentPos });
      }
      
      // Find the common suffix
      let oldEnd = oldContent.length - 1;
      let newEnd = newContent.length - 1;
      while (oldEnd > currentPos && newEnd > currentPos && 
             oldContent[oldEnd] === newContent[newEnd]) {
        oldEnd--;
        newEnd--;
      }
      
      // Handle the changed content
      const deletedContent = oldContent.slice(currentPos, oldEnd + 1);
      if (deletedContent.length > 0) {
        operations.push({ delete: deletedContent.length });
      }
      
      const insertedContent = newContent.slice(currentPos, newEnd + 1);
      if (insertedContent.length > 0) {
        operations.push({ insert: insertedContent });
      }
      
      // Retain the common suffix
      const suffixLength = oldContent.length - oldEnd - 1;
      if (suffixLength > 0) {
        operations.push({ retain: suffixLength });
      }
      
      return operations;
    }
  
    applyOperations(content = '', operations = []) {
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
    }
  
    transformDelta(delta1, delta2) {
      const transformed1 = [];
      const transformed2 = [];
      let pos1 = 0;
      let pos2 = 0;
      
      const ops1 = [...delta1];
      const ops2 = [...delta2];
      
      while (pos1 < ops1.length || pos2 < ops2.length) {
        const op1 = ops1[pos1];
        const op2 = ops2[pos2];
        
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
            ops1[pos1] = { retain: op1.retain - length };
          } else {
            pos1++;
          }
          
          if (op2.retain > length) {
            ops2[pos2] = { retain: op2.retain - length };
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
            ops1[pos1] = { delete: op1.delete - length };
          } else {
            pos1++;
          }
          if (op2.delete > length) {
            ops2[pos2] = { delete: op2.delete - length };
          } else {
            pos2++;
          }
        }
      }
      
      return [transformed1, transformed2];
    }
  
    getVersion() {
      return this.baseVersion;
    }
  
    getContent() {
      return this.content;
    }
  
    destroy() {
      if (this.socket) {
        this.socket.off('content-delta');
        this.socket.off('connect_error');
      }
      this.pendingOperations = [];
      this.appliedOperations = [];
      this.callbacks = {
        onContentChange: null,
        onError: null
      };
    }
  }
  
  // Create and export a singleton instance
  const collaborationService = new CollaborationService();
  
  export default collaborationService;