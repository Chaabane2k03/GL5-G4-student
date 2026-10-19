package tn.fst.apigateway.resilience;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Stub backend whose behaviour each test controls, so circuit breaker, retry, rate limiter
 * and bulkhead can each be driven through a real HTTP exchange through the gateway.
 *
 * <p>Unlike the stub in {@code GatewayRoutingIntegrationTest} (which always answers 200 so
 * routing can be asserted), this one can be switched to fail, made slow, or made to fail
 * a fixed number of times before succeeding.
 */
final class FailingStubBackend implements AutoCloseable {

    private final HttpServer server;

    /** When true every request is answered with {@link #failureStatus}. */
    private final AtomicBoolean failing = new AtomicBoolean(false);

    /** Answers the first N requests with {@link #failureStatus}, then recovers. */
    private final AtomicInteger failuresBeforeSuccess = new AtomicInteger(0);

    /** Artificial per-request delay in milliseconds; 0 means respond immediately. */
    private final AtomicInteger delayMillis = new AtomicInteger(0);

    private final AtomicInteger failureStatus = new AtomicInteger(503);

    private final AtomicInteger requestCount = new AtomicInteger(0);

    FailingStubBackend() throws IOException {
        this.server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        this.server.createContext("/", exchange -> {
            requestCount.incrementAndGet();

            int delay = delayMillis.get();
            if (delay > 0) {
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }

            int status = statusForThisRequest();
            byte[] body = ("{\"status\":" + status + "}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        this.server.start();
    }

    private int statusForThisRequest() {
        if (failing.get()) {
            return failureStatus.get();
        }
        int remaining = failuresBeforeSuccess.get();
        if (remaining > 0 && failuresBeforeSuccess.decrementAndGet() >= 0) {
            return failureStatus.get();
        }
        return 200;
    }

    String uri() {
        return "http://localhost:" + server.getAddress().getPort();
    }

    /** Every request is answered with 503 until {@link #recover()} is called. */
    void failPermanently() {
        failuresBeforeSuccess.set(0);
        failing.set(true);
    }

    /** Answers the next {@code count} requests with 503, then starts succeeding. */
    void failFirst(int count) {
        failing.set(false);
        failuresBeforeSuccess.set(count);
    }

    /** Always succeeds from now on. */
    void recover() {
        failing.set(false);
        failuresBeforeSuccess.set(0);
    }

    void respondWith(int status) {
        this.failureStatus.set(status);
    }

    /** Makes each request take {@code millis}, used to fill the bulkhead. */
    void delayEachRequestBy(int millis) {
        this.delayMillis.set(millis);
    }

    int requestCount() {
        return requestCount.get();
    }

    void resetRequestCount() {
        requestCount.set(0);
    }

    @Override
    public void close() {
        server.stop(0);
    }
}