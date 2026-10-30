package tn.fst.test;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class TemporaryClientApplication {

    public static void main(String[] args) {
        SpringApplication.run(TemporaryClientApplication.class, args);
    }
}
