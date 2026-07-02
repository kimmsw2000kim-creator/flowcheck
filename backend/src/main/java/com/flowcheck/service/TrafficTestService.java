package com.flowcheck.service;

public interface TrafficTestService {

    void executeLoadTestAsync(String testId, int vusers, int duration);
}
