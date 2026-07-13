package com.flowcheck.repository;

import com.flowcheck.domain.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostRepository extends JpaRepository<Post, Long> {

    Page<Post> findByTitleContainingIgnoreCaseOrWriterEmailContainingIgnoreCase(
            String title,
            String writerEmail,
            Pageable pageable
    );
}