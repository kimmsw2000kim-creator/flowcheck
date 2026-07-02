package com.flowcheck.service;

import org.springframework.stereotype.Service;

@Service
public class TrafficTestServiceImpl implements TrafficTestService {

    @Override
    public void executeLoadTestAsync(String testId, int vusers, int duration) {
    }
}
