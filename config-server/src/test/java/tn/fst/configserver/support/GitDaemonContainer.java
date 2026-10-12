package tn.fst.configserver.support;

import java.nio.file.Path;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

/**
 * Temporary Git service used by the integration tests. It runs an anonymous
 * {@code git daemon} inside a container and serves the repository created by
 * {@link TestConfigRepository} over the {@code git://} protocol, which is what
 * the Config Server's JGit backend consumes.
 */
public class GitDaemonContainer extends GenericContainer<GitDaemonContainer> {

    public static final int GIT_PORT = 9418;

    public GitDaemonContainer(Path repositoryRoot) {
        super(DockerImageName.parse("alpine:3.20"));
        withExposedPorts(GIT_PORT);
        withCopyFileToContainer(MountableFile.forHostPath(repositoryRoot.toAbsolutePath().toString()), "/repos");
        withCommand("sh", "-c",
                "apk add --no-cache git git-daemon >/dev/null 2>&1"
                        + " && git config --global --add safe.directory '*'"
                        + " && exec git daemon --reuseaddr --base-path=/repos --export-all"
                        + " --listen=0.0.0.0 --verbose");
        waitingFor(Wait.forLogMessage(".*Ready to rumble.*", 1));
    }

    public String repositoryUri() {
        return "git://" + getHost() + ":" + getMappedPort(GIT_PORT) + "/" + TestConfigRepository.REPO_NAME;
    }
}
