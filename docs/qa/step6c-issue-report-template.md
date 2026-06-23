# Step 6C: Issue Report Template

When a test fails during the Step 6C Real-Device QA phase, use this template to document the failure precisely. This ensures developers have enough context to reproduce and fix the bug without guesswork.

## Bug Report

**Issue Title:** [Short, descriptive summary, e.g., "iPhone Safari Camera Freezes on Front/Back Switch"]

**Severity:** [Critical | High | Medium | Low]

**Reproducibility:** [Always | Sometimes | Rare]

### Environment
* **Device / Model:** [e.g., iPhone 13 Pro]
* **OS Version:** [e.g., iOS 16.4]
* **Browser / Version:** [e.g., Safari 16]
* **Network Condition:** [e.g., Fast Wi-Fi, 4G, 3G]

### Exact Steps to Reproduce
1. [Step 1, e.g., Join meeting room URL]
2. [Step 2, e.g., Grant camera permissions]
3. [Step 3, e.g., Tap the 'switch camera' button on bottom toolbar]

### Expected Result
[What should have happened, e.g., The video feed swaps from the front camera to the rear camera seamlessly without dropping the connection.]

### Actual Result
[What actually happened, e.g., The screen turns black, the video track drops, and does not recover until the page is fully refreshed.]

### Evidence
* **Screenshot / Video:** [Link to artifact or upload]
* **Console Error:** 
```text
[Paste any visible browser console errors here if available]
```
* **Server Log Excerpt:**
```text
[Paste relevant backend signaling server logs if applicable]
```

### Optional Diagnostic Data (If QA Mode is enabled)
* **User ID:** [...]
* **Role:** [...]
* **Camera Track State:** [...]
* **Reconnect Count:** [...]
