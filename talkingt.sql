--
-- PostgreSQL database dump
--

\restrict 2zD4TdSMdgQ1bDzbfksjZiUi4dGpb5zYvYBQdimIa9z3jQ8a8PKcKkZy0e8v8PU

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-22 22:45:56

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 25757)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5117 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 25788)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100),
    is_group boolean DEFAULT false,
    avatar text DEFAULT NULL::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    invite_code character varying(32),
    group_avatar text,
    max_members integer DEFAULT 50
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 25846)
-- Name: friends; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friends (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    friend_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.friends OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 25994)
-- Name: message_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_reads (
    id integer NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.message_reads OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 25993)
-- Name: message_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_reads_id_seq OWNER TO postgres;

--
-- TOC entry 5118 (class 0 OID 0)
-- Dependencies: 226
-- Name: message_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_reads_id_seq OWNED BY public.message_reads.id;


--
-- TOC entry 223 (class 1259 OID 25823)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid,
    sender_id uuid,
    content text NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 25803)
-- Name: participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    conversation_id uuid,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'member'::character varying
);


ALTER TABLE public.participants OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 25904)
-- Name: user_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_conversations (
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    unread_count integer DEFAULT 0,
    last_read_at timestamp without time zone,
    deleted_at timestamp without time zone
);


ALTER TABLE public.user_conversations OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 25768)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    avatar text DEFAULT NULL::character varying,
    is_online boolean DEFAULT false,
    last_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    display_name character varying(100),
    phone character varying(20),
    profile_completed boolean DEFAULT false,
    bio character varying(200)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4914 (class 2604 OID 25997)
-- Name: message_reads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reads ALTER COLUMN id SET DEFAULT nextval('public.message_reads_id_seq'::regclass);


--
-- TOC entry 4925 (class 2606 OID 25926)
-- Name: conversations conversations_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_invite_code_key UNIQUE (invite_code);


--
-- TOC entry 4927 (class 2606 OID 25797)
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- TOC entry 4940 (class 2606 OID 25854)
-- Name: friends friends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);


--
-- TOC entry 4942 (class 2606 OID 25856)
-- Name: friends friends_user_id_friend_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_friend_id_key UNIQUE (user_id, friend_id);


--
-- TOC entry 4951 (class 2606 OID 26005)
-- Name: message_reads message_reads_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- TOC entry 4953 (class 2606 OID 26003)
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 25835)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4932 (class 2606 OID 25810)
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- TOC entry 4934 (class 2606 OID 25812)
-- Name: participants participants_user_id_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_user_id_conversation_id_key UNIQUE (user_id, conversation_id);


--
-- TOC entry 4947 (class 2606 OID 25911)
-- Name: user_conversations user_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_conversations
    ADD CONSTRAINT user_conversations_pkey PRIMARY KEY (user_id, conversation_id);


--
-- TOC entry 4917 (class 2606 OID 25787)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4919 (class 2606 OID 25872)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 4921 (class 2606 OID 25783)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 25785)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4928 (class 1259 OID 25930)
-- Name: idx_conversations_invite_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_invite_code ON public.conversations USING btree (invite_code) WHERE (invite_code IS NOT NULL);


--
-- TOC entry 4948 (class 1259 OID 26016)
-- Name: idx_message_reads_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_reads_message ON public.message_reads USING btree (message_id);


--
-- TOC entry 4949 (class 1259 OID 26017)
-- Name: idx_message_reads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_reads_user ON public.message_reads USING btree (user_id);


--
-- TOC entry 4935 (class 1259 OID 25867)
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);


--
-- TOC entry 4936 (class 1259 OID 25868)
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- TOC entry 4929 (class 1259 OID 25870)
-- Name: idx_participants_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_participants_conversation ON public.participants USING btree (conversation_id);


--
-- TOC entry 4930 (class 1259 OID 25869)
-- Name: idx_participants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_participants_user ON public.participants USING btree (user_id);


--
-- TOC entry 4943 (class 1259 OID 26019)
-- Name: idx_user_conversations_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_conversations_deleted ON public.user_conversations USING btree (user_id, deleted_at);


--
-- TOC entry 4944 (class 1259 OID 25923)
-- Name: idx_user_conversations_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_conversations_unread ON public.user_conversations USING btree (user_id, unread_count) WHERE (unread_count > 0);


--
-- TOC entry 4945 (class 1259 OID 25922)
-- Name: idx_user_conversations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_conversations_user ON public.user_conversations USING btree (user_id);


--
-- TOC entry 4954 (class 2606 OID 25798)
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4959 (class 2606 OID 25862)
-- Name: friends friends_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4960 (class 2606 OID 25857)
-- Name: friends friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4963 (class 2606 OID 26006)
-- Name: message_reads message_reads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 4964 (class 2606 OID 26011)
-- Name: message_reads message_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4957 (class 2606 OID 25836)
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4958 (class 2606 OID 25841)
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4955 (class 2606 OID 25818)
-- Name: participants participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4956 (class 2606 OID 25813)
-- Name: participants participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4961 (class 2606 OID 25917)
-- Name: user_conversations user_conversations_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_conversations
    ADD CONSTRAINT user_conversations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4962 (class 2606 OID 25912)
-- Name: user_conversations user_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_conversations
    ADD CONSTRAINT user_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-01-22 22:45:56

--
-- PostgreSQL database dump complete
--

\unrestrict 2zD4TdSMdgQ1bDzbfksjZiUi4dGpb5zYvYBQdimIa9z3jQ8a8PKcKkZy0e8v8PU

