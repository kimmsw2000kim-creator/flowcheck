package com.flowcheck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class FlowcheckApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlowcheckApplication.class, args);
    }
}
