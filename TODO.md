# TODO: Optimize Frame Processing to Fix Worker Timeout

## Steps to Complete

1. **Optimize handle_frame function**
   - Lower imgsz for YOLO prediction to reduce memory usage
   - Add early returns and better error handling
   - Implement timeout mechanism for frame processing
   - Add performance logging (processing time, memory usage)

2. **Add memory monitoring**
   - Add memory usage tracking in handle_frame
   - Implement cleanup for global variables (all_snapshots, notified_snapshots)
   - Add periodic cleanup of old snapshots

3. **Implement timeout handling**
   - Add timeout wrapper for frame processing
   - Prevent long-running operations from hanging the worker

4. **Add performance metrics logging**
   - Log frame processing time
   - Log memory usage before/after processing
   - Add debug logs for troubleshooting

5. **Test the changes**
   - Run the application and monitor for timeouts
   - Check logs for performance metrics
