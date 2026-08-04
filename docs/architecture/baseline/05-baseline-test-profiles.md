# 05 Baseline Test Profiles

This document defines the 10 standardized load and failure profiles used to establish the Konn3ct Phase 0 baseline. 

For every test executed, the following must be recorded:
* Test environment & Server/Pod specifications
* Bot configuration
* Connected users, audio/video/screen producers, and consumers
* Test duration
* Join success rate & Time to first media
* CPU and memory & Incoming/outgoing bitrate
* Errors, disconnections, and reconnection results
* Observed bottleneck & Pass/Fail result

## A. Small Meeting
* **Scale:** 5 participants
* **Media:** 2 cameras, 5 microphones
* **Features:** Chat and reactions enabled

## B. Enterprise Meeting
* **Scale:** 20 participants
* **Media:** 5 cameras, 20 audio producers, 1 screen share
* **Features:** Chat, polls and recording

## C. Medium Meeting
* **Scale:** 100 participants
* **Media:** 5 cameras, 1 screen share
* **Features:** Controlled video subscriptions

## D. Large Meeting
* **Scale:** 500 participants
* **Media:** 5 cameras, 1 screen share
* **Features:** Controlled consumers

## E. Target Large Meeting
* **Scale:** 1,000 participants
* **Media:** 5 cameras, 1 screen share
* **Features:** Controlled consumers

## F. Concurrent Rooms
* **Scale:** Run progressively at 10, 25, 50, and 100 simultaneous rooms.
* **Media:** Use 5 to 20 users per room depending on available test infrastructure.

## G. Join Storm
* **Scale:** 100, 250, and 500 participants attempting to join the same room in a short burst.

## H. Signalling Recovery
* **Action:** Restart or kill the current signalling process.
* **Metrics:** Measure socket reconnection and meeting-state recovery time.

## I. Media Failure
* **Action:** Terminate a mediasoup worker or current media process.
* **Metrics:** Document actual user impact and recovery behavior.

## J. Redis Degradation
* **Action:** Introduce controlled latency or temporary loss of Redis.
* **Metrics:** Document which functions stop and whether established media continues flowing.
