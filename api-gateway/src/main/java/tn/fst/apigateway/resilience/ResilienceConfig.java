package tn.fst.apigateway.resilience;

import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.caffeine.CaffeineProxyManager;
import io.github.bucket4j.distributed.proxy.AsyncProxyManager;
import io.github.bucket4j.distributed.remote.RemoteBucketState;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Backing store for the gateway's {@code RequestRateLimiter} filter.
 *
 * <p>Spring Cloud Gateway ships two limiter implementations: {@code RedisRateLimiter}
 * (needs a Redis container, which this stack does not run) and {@code Bucket4jRateLimiter}.
 * Bucket4j is the one used here. Providing an {@link AsyncProxyManager} bean is the
 * supported extension point: the gateway then auto-configures its own
 * {@code bucket4jRateLimiter} bean, and the routes reference it as
 * {@code #{@bucket4jRateLimiter}}.
 *
 * <p>Caffeine gives an in-memory backend, so rate limiting needs no extra infrastructure.
 * Per-route capacity and refill rate are not set here; the limiter reads them from each
 * route's {@code bucket4j-rate-limiter.*} filter args.
 *
 * <p><b>Limiter state lives in this JVM only.</b> Running a second gateway replica gives
 * every caller twice the allowance. If the gateway is scaled horizontally, swap this for a
 * Redis-backed proxy manager rather than accepting the doubled limit.
 */
@Configuration(proxyBeanMethods = false)
public class ResilienceConfig {

    /**
     * Upper bound on tracked rate-limit keys, so an unbounded key space (one entry per
     * distinct authenticated caller, in the general case) cannot grow the cache forever.
     */
    private static final long MAX_TRACKED_KEYS = 10_000L;

    /** Idle lifetime for a bucket after its key is last seen. */
    private static final Duration BUCKET_EXPIRY = Duration.ofMinutes(1);

    @Bean
    public AsyncProxyManager<String> bucketProxyManager() {
        // Caffeine.newBuilder() is Caffeine<Object, Object>. Casting to the concrete key and
        // state types is safe here: Bucket4j only ever stores a RemoteBucketState against
        // the String keys it is handed.
        @SuppressWarnings("unchecked")
        Caffeine<String, RemoteBucketState> cache =
                (Caffeine<String, RemoteBucketState>) (Caffeine<?, ?>) Caffeine.newBuilder()
                        .maximumSize(MAX_TRACKED_KEYS);
        return new CaffeineProxyManager<>(cache, BUCKET_EXPIRY).asAsync();
    }
}