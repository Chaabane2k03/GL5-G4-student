package tn.fst.configserver.support;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import org.eclipse.jgit.api.Git;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * Builds a throwaway Git repository at runtime. The repository is seeded with
 * every {@code config/*.properties} file that ships with the Config Server, so
 * the integration tests exercise exactly the configuration that is under
 * version control.
 */
public final class TestConfigRepository {

    public static final String REPO_NAME = "config-repo.git";
    private static final String BRANCH = "main";

    private TestConfigRepository() {
    }

    /**
     * Creates a temporary working repository, commits the Config Server's
     * properties and returns the parent folder of a bare clone that can be
     * mounted into the Git daemon container.
     */
    public static Path createRepositoryRoot() {
        try {
            Path root = Files.createTempDirectory("config-repo-root");
            Path work = root.resolve("work");
            seedWorkingTree(work);
            createBareClone(work, root.resolve(REPO_NAME));
            return root;
        }
        catch (Exception e) {
            throw new IllegalStateException("Unable to build the temporary Git configuration repository", e);
        }
    }

    private static void seedWorkingTree(Path work) throws Exception {
        try (Git git = Git.init().setInitialBranch(BRANCH).setDirectory(work.toFile()).call()) {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            for (Resource resource : resolver.getResources("classpath*:config/*.properties")) {
                try (InputStream in = resource.getInputStream()) {
                    Files.copy(in, work.resolve(resource.getFilename()));
                }
            }
            git.add().addFilepattern(".").call();
            git.commit()
                    .setMessage("Seed test configuration")
                    .setAuthor("config-tests", "config-tests@example.com")
                    .setCommitter("config-tests", "config-tests@example.com")
                    .call();
        }
    }

    private static void createBareClone(Path work, Path bare) throws Exception {
        try (Git ignored = Git.cloneRepository()
                .setURI(work.toUri().toString())
                .setDirectory(bare.toFile())
                .setBare(true)
                .call()) {
            // The bare clone is the served repository.
        }
    }
}
