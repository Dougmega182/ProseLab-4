=== DEBUG RUN ===
python : Extraction failed for chapter PROLOGUE
At line:1 char:224
+ ... oding utf8; python -m phase6 analyze "E:\Ai\ProseLabV2\Quantum Shadow ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Extraction failed for chapter PROLOGUE:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Traceback (most recent call last):
  File "E:\Ai\ProseLabV2\proselab\narrativeOS\phase6\pipeline.py", line 340, in analyze_chapter
    delta = fn(
            ^^^
  File "E:\Ai\ProseLabV2\proselab\narrativeOS\phase6\extractor.py", line 211, in extract_delta
    raise ExtractionError(
phase6.extractor.ExtractionError: Could not parse JSON from model output for chapter PROLOGUE. Raw text saved to 
extraction log.
  Γ¥î Ch 0       failed   Extraction failed: Could not parse JSON from model output for chapter PROLOGUE. Raw text saved to extraction log.
